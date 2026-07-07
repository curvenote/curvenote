#!/usr/bin/env bash
# Clone gitignored extension repos listed in scripts/extensions.manifest.json (gitignored locally).
set -Eeuo pipefail

ROOT="${ROOT:-$(git rev-parse --show-toplevel)}"
cd "$ROOT"

CLOUD_ENV="${CLOUD_ENV:-default}"
MANIFEST="${EXTENSIONS_MANIFEST:-${ROOT}/scripts/extensions.manifest.json}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "→ No extensions manifest (${MANIFEST}); skipping extension clones"
  exit 0
fi

clone_one() {
  local repo="$1"
  local path="$2"
  local branch="$3"

  if [[ -d "${path}/.git" ]]; then
    echo "→ Extension already cloned: ${path} (fetch + checkout ${branch})"
    git -C "$path" fetch --depth 1 origin "$branch" 2>/dev/null || git -C "$path" fetch origin "$branch"
    git -C "$path" checkout "$branch"
    git -C "$path" pull --ff-only origin "$branch" 2>/dev/null || true
    return 0
  fi

  if [[ -d "$path" ]]; then
    echo "❌ ${path} exists but is not a git repo; remove it and retry." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$path")"
  local url="https://${repo}.git"
  echo "→ Cloning ${url} → ${path} (branch: ${branch})"
  git clone --depth 1 --branch "$branch" "$url" "$path"
}

count="$(node -e "
  const m = require('${MANIFEST}');
  const env = process.env.CLOUD_ENV || 'default';
  const exts = m.environments?.[env]?.extensions ?? [];
  console.log(exts.length);
")"

if [[ "$count" == "0" ]]; then
  echo "→ No extension clones configured for CLOUD_ENV=${CLOUD_ENV}"
  exit 0
fi

echo "→ Cloning ${count} extension repo(s) for CLOUD_ENV=${CLOUD_ENV}"

node -e "
  const m = require('${MANIFEST}');
  const env = process.env.CLOUD_ENV || 'default';
  const exts = m.environments?.[env]?.extensions ?? [];
  for (const e of exts) {
    process.stdout.write([e.repo, e.path, e.branch || 'main'].join('\t') + '\n');
  }
" | while IFS=$'\t' read -r repo path branch; do
  clone_one "$repo" "$path" "$branch"
done
