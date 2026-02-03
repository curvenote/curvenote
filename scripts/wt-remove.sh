#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: wt-remove.sh <absolute-worktree-path> [--force]

Removes a git worktree by absolute path.

If the worktree contains submodules, git may refuse to remove it.
This script will:
  - attempt git worktree remove
  - deinit submodules and retry
  - if still blocked, delete the directory and prune stale worktree metadata

By default, this script refuses to proceed if the worktree (or any initialized
submodule) has uncommitted changes. Use --force to override.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

WT_DIR=""
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f)
      FORCE=true
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -z "$WT_DIR" ]]; then
        WT_DIR="$1"
        shift
      else
        echo "Unexpected extra argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$WT_DIR" ]]; then
  usage >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "❌ Not inside a git repository." >&2
  exit 1
fi

cd "$ROOT"

if [[ ! "$WT_DIR" =~ ^/ ]]; then
  echo "❌ Expected an absolute path, got: ${WT_DIR}" >&2
  exit 1
fi

if [[ ! -e "$WT_DIR" ]]; then
  echo "❌ Worktree path does not exist: ${WT_DIR}" >&2
  exit 1
fi
if [[ ! -d "$WT_DIR" ]]; then
  echo "❌ Worktree path is not a directory: ${WT_DIR}" >&2
  exit 1
fi

# Canonicalize when possible (handles /var ↔ /private/var, symlinks, etc.)
WT_DIR="$(cd "$WT_DIR" && pwd -P)"

# Ensure this path is actually a registered worktree for this repo.
if ! git worktree list --porcelain | awk -v wt="$WT_DIR" '
  $1=="worktree" { current=$2 }
  current==wt { found=1 }
  END { exit(found?0:1) }
'; then
  echo "❌ Refusing to remove: path is not a known worktree of this repo: ${WT_DIR}" >&2
  exit 1
fi

is_dirty_repo() {
  local dir="$1"
  [[ -d "$dir" ]] || return 1
  # status --porcelain returns non-empty if dirty
  [[ -n "$(git -C "$dir" status --porcelain 2>/dev/null || true)" ]]
}

is_dirty_submodules() {
  local dir="$1"
  [[ -d "$dir" ]] || return 1
  [[ -f "${dir}/.gitmodules" ]] || return 1
  # foreach prints output per submodule; we treat any porcelain output as dirty
  local out
  out="$(git -C "$dir" submodule foreach --recursive 'git status --porcelain' 2>/dev/null || true)"
  [[ -n "$(echo "$out" | tr -d '[:space:]')" ]]
}

if [[ "$FORCE" != "true" ]]; then
  if is_dirty_repo "$WT_DIR"; then
    echo "❌ Worktree has uncommitted changes: ${WT_DIR}" >&2
    echo "   Re-run with --force to override." >&2
    exit 1
  fi
  if is_dirty_submodules "$WT_DIR"; then
    echo "❌ One or more submodules have uncommitted changes in: ${WT_DIR}" >&2
    echo "   Re-run with --force to override." >&2
    exit 1
  fi
fi

worktree_gitdir_for_path() {
  local wt="$1"
  git worktree list --porcelain | awk -v wt="$wt" '
    $1=="worktree" { current=$2; gitdir="" }
    $1=="gitdir" { gitdir=$2 }
    current==wt && gitdir!="" { print gitdir; exit 0 }
  '
}

GITDIR="$(worktree_gitdir_for_path "$WT_DIR" || true)"

try_remove() {
  if [[ "$FORCE" == "true" ]]; then
    git worktree remove --force "$WT_DIR" 2>&1
  else
    git worktree remove "$WT_DIR" 2>&1
  fi
}

echo "→ Removing worktree: ${WT_DIR}"

set +e
OUT="$(try_remove)"
CODE=$?
set -e

if [[ $CODE -ne 0 ]]; then
  echo "$OUT" >&2
  echo "→ Git refused to remove; attempting submodule deinit and retry"

  # Best effort; don't fail removal if deinit fails.
  set +e
  git -C "$WT_DIR" submodule deinit -f --all >/dev/null 2>&1
  set -e

  set +e
  OUT2="$(try_remove)"
  CODE2=$?
  set -e

  if [[ $CODE2 -ne 0 ]]; then
    echo "$OUT2" >&2
    echo "→ Still blocked; deleting directory and pruning worktree metadata"

    rm -rf "$WT_DIR"
    git worktree prune

    if [[ -n "${GITDIR:-}" && -d "$GITDIR" ]]; then
      rm -rf "$GITDIR"
      git worktree prune
    fi
  fi
fi

echo "✅ Removed worktree: ${WT_DIR}"
