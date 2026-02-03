#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: wt-add.sh <name>

Creates a new git worktree at ../trees/<name> and a branch named <name>,
based off the local 'dev' branch.

Also:
  - initializes submodules (recursive)
  - copies:
      platform/scms/.app-config.development.yml
      platform/scms/.env
      .env
    into the same relative locations in the worktree
    (warns if any are missing and continues)

EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  usage >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "❌ Not inside a git repository." >&2
  exit 1
fi

cd "$ROOT"

BASE_BRANCH="dev"
BRANCH="$NAME"
WT_PARENT="${ROOT}/../trees"
WT_DIR="${WT_PARENT}/${NAME}"

if [[ -e "$WT_DIR" ]]; then
  echo "❌ Worktree path already exists: ${WT_DIR}" >&2
  exit 1
fi

# Ensure base branch exists locally (create tracking branch if only remote exists).
if ! git show-ref --verify --quiet "refs/heads/${BASE_BRANCH}"; then
  if git show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
    echo "→ Creating local '${BASE_BRANCH}' tracking branch from origin/${BASE_BRANCH}"
    git branch --track "${BASE_BRANCH}" "origin/${BASE_BRANCH}"
  else
    echo "❌ Base branch '${BASE_BRANCH}' not found (neither local nor origin/${BASE_BRANCH})." >&2
    exit 1
  fi
fi

# Refuse to proceed if the target branch already exists (local or remote).
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "❌ Branch already exists locally: ${BRANCH}" >&2
  exit 1
fi
if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  echo "❌ Branch already exists on origin: ${BRANCH}" >&2
  exit 1
fi

mkdir -p "$WT_PARENT"

echo "→ Adding worktree at: ${WT_DIR}"
echo "  - branch: ${BRANCH}"
echo "  - base:   ${BASE_BRANCH}"
git worktree add -b "${BRANCH}" "${WT_DIR}" "${BASE_BRANCH}"

echo "→ Initializing submodules in ${WT_DIR}"
git -C "${WT_DIR}" submodule sync --recursive
git -C "${WT_DIR}" submodule update --init --recursive

copy_or_warn() {
  local src="$1"
  local dest="$2"

  if [[ ! -f "$src" ]]; then
    echo "⚠️  Missing file; skipping copy: ${src}" >&2
    return 0
  fi

  mkdir -p "$(dirname "$dest")"
  cp -p "$src" "$dest"
}

echo "→ Copying development config files (warn on missing)"
copy_or_warn "${ROOT}/platform/scms/.app-config.development.yml" "${WT_DIR}/platform/scms/.app-config.development.yml"
copy_or_warn "${ROOT}/platform/scms/.env" "${WT_DIR}/platform/scms/.env"
copy_or_warn "${ROOT}/.env" "${WT_DIR}/.env"

echo "✅ Worktree ready: ${WT_DIR}"
echo
echo "→ git worktree list"
git worktree list
