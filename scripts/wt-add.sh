#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  wt-add.sh <name> [base-branch]
  wt-add.sh --existing <branch> [worktree-name]

npm (from repo root):
  npm run wt:create -- <name> [base-branch]
  npm run wt:existing -- <branch> [worktree-name]

Creates a git worktree under ../trees/ (next to the repo root).

  <name> [base-branch]
      New branch <name> at ../trees/<name>, based on base-branch or the current branch.

  --existing <branch> [worktree-name]
      Check out an existing branch into a new worktree at ../trees/<worktree-name>.
      If worktree-name is omitted, it is derived from the branch (slashes become hyphens).
      Resolves a local branch first; if missing, uses origin/<branch> (creates the local branch).

Also:
  - initializes submodules (recursive)
  - copies:
      platform/scms/.app-config.development.yml
      platform/scms/.app-config.secrets.development.yml
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

MODE="new"
EXISTING_BRANCH=""
WT_NAME_OVERRIDE=""
NAME=""
BASE_BRANCH=""

if [[ "${1:-}" == "--existing" || "${1:-}" == "-e" ]]; then
  MODE="existing"
  EXISTING_BRANCH="${2:-}"
  WT_NAME_OVERRIDE="${3:-}"
  if [[ -z "$EXISTING_BRANCH" ]]; then
    echo "❌ --existing requires a branch name (e.g. feat/my-feature)." >&2
    usage >&2
    exit 1
  fi
else
  NAME="${1:-}"
  BASE_BRANCH="${2:-}"
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "❌ Not inside a git repository." >&2
  exit 1
fi

cd "$ROOT"

WT_PARENT="${ROOT}/../trees"

post_worktree_setup() {
  local wt_dir="$1"
  echo "→ Initializing submodules in ${wt_dir}"
  git -C "${wt_dir}" submodule sync --recursive
  git -C "${wt_dir}" submodule update --init --recursive

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
  copy_or_warn "${ROOT}/platform/scms/.app-config.development.yml" "${wt_dir}/platform/scms/.app-config.development.yml"
  copy_or_warn "${ROOT}/platform/scms/.app-config.secrets.development.yml" "${wt_dir}/platform/scms/.app-config.secrets.development.yml"
  copy_or_warn "${ROOT}/platform/scms/.env" "${wt_dir}/platform/scms/.env"
  copy_or_warn "${ROOT}/.env" "${wt_dir}/.env"

  echo "✅ Worktree ready: ${wt_dir}"
  echo
  echo "→ git worktree list"
  git worktree list
}

if [[ "$MODE" == "existing" ]]; then
  local_ref="refs/heads/${EXISTING_BRANCH}"
  remote_ref="refs/remotes/origin/${EXISTING_BRANCH}"

  if [[ -n "$WT_NAME_OVERRIDE" ]]; then
    WT_DIR_NAME="$WT_NAME_OVERRIDE"
  else
    WT_DIR_NAME="${EXISTING_BRANCH//\//-}"
  fi
  WT_DIR="${WT_PARENT}/${WT_DIR_NAME}"

  if [[ -e "$WT_DIR" ]]; then
    echo "❌ Worktree path already exists: ${WT_DIR}" >&2
    exit 1
  fi

  mkdir -p "$WT_PARENT"

  echo "→ Adding worktree at: ${WT_DIR}"
  echo "  - branch: ${EXISTING_BRANCH}"

  if git show-ref --verify --quiet "$local_ref"; then
    git worktree add "${WT_DIR}" "${EXISTING_BRANCH}"
  elif git show-ref --verify --quiet "$remote_ref"; then
    echo "  - from: origin/${EXISTING_BRANCH} (new local branch)"
    git worktree add -b "${EXISTING_BRANCH}" "${WT_DIR}" "origin/${EXISTING_BRANCH}"
  else
    echo "❌ Branch not found locally (refs/heads/${EXISTING_BRANCH}) or on origin (origin/${EXISTING_BRANCH})." >&2
    echo "   Fetch the branch (e.g. git fetch origin ${EXISTING_BRANCH}) and retry." >&2
    exit 1
  fi

  # Be explicit: new worktree must be on the requested branch (not detached HEAD).
  if ! git -C "${WT_DIR}" switch "${EXISTING_BRANCH}" 2>/dev/null; then
    git -C "${WT_DIR}" checkout "${EXISTING_BRANCH}"
  fi

  post_worktree_setup "${WT_DIR}"
  exit 0
fi

# --- new branch mode ---
if [[ -z "$NAME" ]]; then
  usage >&2
  exit 1
fi

if [[ -n "$BASE_BRANCH" ]]; then
  BASE_REF="$BASE_BRANCH"
  if ! git rev-parse --verify -q "$BASE_REF" >/dev/null 2>&1; then
    echo "❌ Base branch or ref not found: ${BASE_REF}" >&2
    exit 1
  fi
else
  # Base the new worktree on the current branch (or HEAD if detached).
  BASE_REF="$(git branch --show-current)"
  if [[ -z "$BASE_REF" ]]; then
    BASE_REF="$(git rev-parse HEAD)"
    echo "→ Detached HEAD; using current commit as base: ${BASE_REF}"
  fi
fi

BRANCH="$NAME"
WT_DIR="${WT_PARENT}/${NAME}"

if [[ -e "$WT_DIR" ]]; then
  echo "❌ Worktree path already exists: ${WT_DIR}" >&2
  exit 1
fi

# Refuse to proceed if the target branch already exists (local or remote).
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "❌ Branch already exists locally: ${BRANCH}" >&2
  echo "   Use: npm run wt:create -- --existing ${BRANCH}" >&2
  exit 1
fi
if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  echo "❌ Branch already exists on origin: ${BRANCH}" >&2
  echo "   Use: npm run wt:create -- --existing ${BRANCH}" >&2
  exit 1
fi

mkdir -p "$WT_PARENT"

echo "→ Adding worktree at: ${WT_DIR}"
echo "  - branch: ${BRANCH}"
echo "  - base:   ${BASE_REF}"
git worktree add -b "${BRANCH}" "${WT_DIR}" "${BASE_REF}"

post_worktree_setup "${WT_DIR}"
