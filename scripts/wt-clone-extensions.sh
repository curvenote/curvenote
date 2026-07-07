#!/usr/bin/env bash
# Clone git repos under extensions/ from a source checkout into a worktree.
# Repo URLs and branches are read from the source tree — nothing is committed to the monorepo.
set -Eeuo pipefail

SOURCE_ROOT="${1:-}"
DEST_ROOT="${2:-}"

if [[ -z "$SOURCE_ROOT" || -z "$DEST_ROOT" ]]; then
  echo "Usage: wt-clone-extensions.sh <source-repo-root> <worktree-root>" >&2
  exit 1
fi

EXTENSIONS_SRC="${SOURCE_ROOT}/extensions"
if [[ ! -d "$EXTENSIONS_SRC" ]]; then
  echo "→ No extensions/ in source checkout; skipping extension clones"
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

clone_or_update() {
  local src_repo="$1"
  local dest_repo="$2"
  local rel="$3"

  local remote branch head clone_url
  if ! remote="$(git -C "$src_repo" remote get-url origin 2>/dev/null)"; then
    echo "⚠️  No origin remote; skipping ${rel}" >&2
    return 0
  fi

  branch="$(git -C "$src_repo" branch --show-current 2>/dev/null || true)"
  head="$(git -C "$src_repo" rev-parse HEAD)"
  clone_url="$(normalize_clone_url "$remote")"

  if [[ -d "${dest_repo}/.git" ]]; then
    echo "→ Extension already present: ${rel} (sync to ${head:0:8})"
    git -C "$dest_repo" fetch origin --quiet
    if [[ -n "$branch" ]]; then
      git -C "$dest_repo" checkout "$branch" 2>/dev/null || git -C "$dest_repo" checkout -B "$branch"
      git -C "$dest_repo" merge --ff-only "origin/${branch}" 2>/dev/null || git -C "$dest_repo" reset --hard "$head"
    else
      git -C "$dest_repo" checkout "$head"
    fi
    return 0
  fi

  if [[ -e "$dest_repo" ]]; then
    echo "❌ ${dest_repo} exists but is not a git repo; remove it and retry." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$dest_repo")"
  echo "→ Cloning ${rel} (${clone_url})"

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
}

discover_extension_repos() {
  local base="$1"
  local candidate

  for candidate in "${base}"/* "${base}/plugins"/*; do
    [[ -d "$candidate" ]] || continue
    [[ -d "${candidate}/.git" ]] || continue
    printf '%s\n' "$candidate"
  done
}

repo_list="$(discover_extension_repos "$EXTENSIONS_SRC")"
if [[ -z "$repo_list" ]]; then
  echo "→ No git repos under extensions/ or extensions/plugins/; skipping"
  exit 0
fi

count=0
while IFS= read -r src_repo; do
  [[ -n "$src_repo" ]] || continue
  count=$((count + 1))
done <<< "$repo_list"

echo "→ Cloning ${count} extension repo(s) from source checkout into worktree"

while IFS= read -r src_repo; do
  [[ -n "$src_repo" ]] || continue
  rel="${src_repo#"${SOURCE_ROOT}/"}"
  clone_or_update "$src_repo" "${DEST_ROOT}/${rel}" "$rel"
done <<< "$repo_list"

echo "✅ Extension repos ready in worktree (${count} repo(s))"
