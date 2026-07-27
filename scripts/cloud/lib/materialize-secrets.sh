#!/usr/bin/env bash
# Write gitignored config files from Cursor Cloud Runtime Secrets (environment variables).
# Mapping is defined in scripts/cloud/secrets.manifest.json (gitignored — copy from secrets.manifest.example.json).
set -Eeuo pipefail

write_secret_file() {
  local env_var="$1"
  local dest="$2"

  if [[ -z "${!env_var:-}" ]]; then
    echo "⚠️  Missing Runtime Secret ${env_var}; skipping ${dest}" >&2
    return 0
  fi

  mkdir -p "$(dirname "$dest")"
  printf '%s' "${!env_var}" >"$dest"
  echo "→ Wrote ${env_var} → ${dest}"
}

ROOT="${ROOT:-$(git rev-parse --show-toplevel)}"
cd "$ROOT"

CLOUD_ENV="${CLOUD_ENV:-default}"
MANIFEST="${SECRETS_MANIFEST:-${ROOT}/scripts/cloud/secrets.manifest.json}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "→ No secrets manifest (${MANIFEST}); skipping secret materialization" >&2
  exit 0
fi

echo "→ Materializing secrets for CLOUD_ENV=${CLOUD_ENV} (from ${MANIFEST})"

node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('${MANIFEST}', 'utf8'));
  const env = process.env.CLOUD_ENV || 'default';
  const entries = m.environments?.[env] ?? m.environments?.default ?? [];
  if (!entries.length) {
    console.error('No secret mappings for CLOUD_ENV=' + env + ' in manifest');
    process.exit(0);
  }
  for (const e of entries) {
    process.stdout.write([e.envVar, e.path].join('\t') + '\n');
  }
" | while IFS=$'\t' read -r env_var dest; do
  write_secret_file "$env_var" "$dest"
done
