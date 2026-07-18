#!/usr/bin/env bash
# Clone the optional SCMS MCP repo from a source checkout into a worktree.
# Repo URL and branch are read from the source tree — nothing is committed to the monorepo.
set -Eeuo pipefail

SOURCE_ROOT="${1:-}"
DEST_ROOT="${2:-}"

if [[ -z "$SOURCE_ROOT" || -z "$DEST_ROOT" ]]; then
  echo "Usage: wt-clone-mcp.sh <source-repo-root> <worktree-root>" >&2
  exit 1
fi

MCP_SRC="${SOURCE_ROOT}/platform/mcp"
if [[ ! -d "${MCP_SRC}/.git" ]]; then
  echo "→ No platform/mcp git repo in source checkout; skipping MCP clone"
  exit 0
fi

normalize_clone_url() {
  local remote="$1"
  if [[ "$remote" =~ ^git@github.com:(.+)$ ]]; then
    printf 'https://github.com/%s' "${BASH_REMATCH[1]}"
  elif [[ "$remote" =~ ^ssh://git@github.com/(.+)$ ]]; then
    printf 'https://github.com/%s' "${BASH_REMATCH[1]}"
  else
    printf '%s' "$remote"
  fi
}

remote="$(git -C "$MCP_SRC" remote get-url origin 2>/dev/null || true)"
if [[ -z "$remote" ]]; then
  echo "⚠️  platform/mcp has no origin remote; skipping MCP clone" >&2
  exit 0
fi

branch="$(git -C "$MCP_SRC" branch --show-current 2>/dev/null || true)"
head="$(git -C "$MCP_SRC" rev-parse HEAD)"
clone_url="$(normalize_clone_url "$remote")"
dest_repo="${DEST_ROOT}/platform/mcp"
rel="platform/mcp"

if [[ -d "${dest_repo}/.git" ]]; then
  echo "→ MCP repo already present: ${rel} (sync to ${head:0:8})"
  git -C "$dest_repo" fetch origin --quiet
  if [[ -n "$branch" ]]; then
    git -C "$dest_repo" checkout "$branch" 2>/dev/null || git -C "$dest_repo" checkout -B "$branch"
    git -C "$dest_repo" merge --ff-only "origin/${branch}" 2>/dev/null || git -C "$dest_repo" reset --hard "$head"
  else
    git -C "$dest_repo" checkout "$head"
  fi
  echo "✅ MCP repo ready in worktree"
  exit 0
fi

if [[ -e "$dest_repo" ]]; then
  echo "❌ ${dest_repo} exists but is not a git repo; remove it and retry." >&2
  exit 1
fi

mkdir -p "$(dirname "$dest_repo")"
echo "→ Cloning MCP repo ${rel} (${clone_url})"

if [[ -n "$branch" ]]; then
  if git clone --branch "$branch" "$clone_url" "$dest_repo" 2>/dev/null; then
    :
  else
    git clone "$clone_url" "$dest_repo"
    git -C "$dest_repo" checkout "$head"
  fi
else
  git clone "$clone_url" "$dest_repo"
  git -C "$dest_repo" checkout "$head"
fi

echo "✅ MCP repo ready in worktree"
