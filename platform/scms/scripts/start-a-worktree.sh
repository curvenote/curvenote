#!/usr/bin/env bash
set -Eeuo pipefail

# worktree-add.sh
# Adds a git worktree, copies one or more files/dirs from repo root into it,
# ensures they're ignored, and installs Node dependencies.

usage() {
  cat <<'EOF'
Usage: worktree-add.sh <worktree-dir> [branch] [--copy <path>[,<path>...]]...

Arguments:
  worktree-dir          Path where the worktree will be created (e.g. ../feature-x)
  branch                Optional branch name; if omitted, derived from directory name.

Options:
  -c, --copy <paths>    File(s)/dir(s) to copy from repo root into the worktree.
                        Repeat the flag or use a comma-separated list.
                        Example: --copy .env --copy ".npmrc,config/local.yaml"
  -f, --force           Overwrite existing files without prompting

Examples:
  worktree-add.sh ../feature-login feature/login -c .env -c .npmrc
  worktree-add.sh ../bugfix-123 --copy ".env.local,config/local.yaml"
  worktree-add.sh ../feature-x   # derives branch "wt/feature-x" from current branch
EOF
  exit 1
}

[[ $# -lt 1 ]] && usage

WT_DIR=""
BRANCH=""
declare -a COPY_FILES=()
FORCE_OVERWRITE=false

# -------- Parse args --------
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--copy)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; usage; }
      IFS=',' read -r -a parts <<< "$2"
      COPY_FILES+=("${parts[@]}")
      shift 2
      ;;
    -f|--force)
      FORCE_OVERWRITE=true
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2; usage;;
    *)
      ARGS+=("$1"); shift;;
  esac
done

WT_DIR="${ARGS[0]:-}"
BRANCH="${ARGS[1]:-}"
[[ -z "$WT_DIR" ]] && usage

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -z "$ROOT" ]] && { echo "Not inside a git repo."; exit 1; }
cd "$ROOT"

# If no branch provided, derive one from the dir name
if [[ -z "$BRANCH" ]]; then
  CURRENT="$(git rev-parse --abbrev-ref HEAD)"
  BASENAME="$(basename "$WT_DIR" | tr ' ' '-' )"
  BRANCH="wt/${BASENAME}"
  echo "→ No branch provided; using '${BRANCH}' (from '${CURRENT}')."
  # Check if branch already exists
  if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    EXISTING_COMMIT="$(git rev-parse "${BRANCH}")"
    CURRENT_COMMIT="$(git rev-parse "${CURRENT}")"
    if [[ "$EXISTING_COMMIT" != "$CURRENT_COMMIT" ]]; then
      echo "⚠️  Branch '${BRANCH}' already exists at different commit."
      echo "   Existing: ${EXISTING_COMMIT}"
      echo "   Current:  ${CURRENT_COMMIT}"
      echo "   Using existing branch for worktree."
    else
      echo "→ Branch '${BRANCH}' already exists at same commit; using it."
    fi
  else
    git branch --quiet "${BRANCH}" "${CURRENT}" || {
      echo "❌ Failed to create branch '${BRANCH}'" >&2
      exit 1
    }
  fi
fi

echo "→ Adding worktree at: ${WT_DIR} for branch: ${BRANCH}"
git worktree add "$WT_DIR" "$BRANCH"

mkdir -p "$WT_DIR"

# Ensure submodules are checked out in the new worktree
echo "→ Initializing submodules in ${WT_DIR}"
git -C "$WT_DIR" submodule sync --recursive
git -C "$WT_DIR" submodule update --init --recursive

# Ensure .gitignore exists and can be appended to
WT_IGNORE="${WT_DIR}/.gitignore"
touch "$WT_IGNORE"

add_ignore() {
  local name="$1"
  # only add basename; users can customize patterns later if needed
  if ! grep -qE "(^|/)$name(\$|\s)" "$WT_IGNORE"; then
    echo "$name" >> "$WT_IGNORE"
    echo "→ Added '${name}' to ${WT_IGNORE}"
  fi
}

# Validate copy path: allow relative paths (including ..) but reject absolute paths
validate_copy_path() {
  local path="$1"
  # Reject absolute paths (starting with /)
  if [[ "$path" =~ ^/ ]]; then
    echo "❌ Error: Copy path '${path}' is absolute. Use relative paths only." >&2
    return 1
  fi
  return 0
}

should_overwrite() {
  local dest="$1"
  if [[ "$FORCE_OVERWRITE" == "true" ]]; then
    return 0
  fi
  if [[ -e "$dest" ]]; then
    echo -n "⚠️  '${dest}' already exists. Overwrite? [y/N] "
    read -r response
    case "$response" in
      [yY]|[yY][eE][sS]) return 0 ;;
      *) return 1 ;;
    esac
  fi
  return 0
}

copy_scms_app_configs() {
  local SRC_DIR="${ROOT}/platform/scms"
  local DEST_DIR="${WT_DIR}/platform/scms"

  mkdir -p "$DEST_DIR"

  # Match the dev app-config files (and the dev secrets file, if present).
  # These are typically ignored by git and therefore won't exist in a fresh worktree checkout.
  shopt -s nullglob
  local files=(
    "$SRC_DIR"/.app-config.development*.yml
    "$SRC_DIR"/.app-config.development*.yaml
    "$SRC_DIR"/.app-config.secrets.development*.yml
    "$SRC_DIR"/.app-config.secrets.development*.yaml
  )
  shopt -u nullglob

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "ℹ️  No SCMS development app-config files found in ${SRC_DIR}; skipping."
    return 0
  fi

  echo "→ Copying SCMS development app-config files into ${DEST_DIR}"
  for SRC in "${files[@]}"; do
    local BASE
    BASE="$(basename "$SRC")"
    local DEST="${DEST_DIR}/${BASE}"

    if should_overwrite "$DEST"; then
      echo "  - ${BASE}"
      cp "$SRC" "$DEST"
    else
      echo "  - Skipping ${BASE} (destination exists and overwrite declined)"
    fi
  done
}

copy_item() {
  local src_rel="$1"
  
  # Validate path
  if ! validate_copy_path "$src_rel"; then
    return 1
  fi
  
  local SRC="${ROOT}/${src_rel}"
  local BASE="$(basename "$src_rel")"
  local DEST="${WT_DIR}/${BASE}"

  if [[ -d "$SRC" ]]; then
    if should_overwrite "$DEST"; then
      echo "→ Copying dir ${src_rel} → ${DEST}/"
      if command -v rsync >/dev/null 2>&1; then
        rsync -a --delete "$SRC/" "$DEST/"
      else
        mkdir -p "$DEST"
        cp -R "$SRC"/. "$DEST"/
      fi
      add_ignore "$BASE"
    else
      echo "→ Skipping ${src_rel} (destination exists and overwrite declined)"
    fi
  elif [[ -f "$SRC" ]]; then
    if should_overwrite "$DEST"; then
      echo "→ Copying file ${src_rel} → ${DEST}"
      cp "$SRC" "$DEST"
      add_ignore "$BASE"
    else
      echo "→ Skipping ${src_rel} (destination exists and overwrite declined)"
    fi
  else
    echo "⚠️  '${src_rel}' not found in repo root; skipping."
  fi
}

# Copy requested files/dirs
if [[ ${#COPY_FILES[@]} -gt 0 ]]; then
  for item in "${COPY_FILES[@]}"; do
    # trim surrounding quotes/spaces
    item="${item%\"}"; item="${item#\"}"
    item="${item%\'}"; item="${item#\'}"
    item="$(echo -n "$item" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    [[ -z "$item" ]] && continue
    copy_item "$item"
  done
else
  echo "ℹ️  No --copy items specified; skipping copy."
fi

# Copy SCMS dev app-configs into the new worktree (if they exist here)
copy_scms_app_configs

# Install Node dependencies
if [[ -f "$WT_DIR/package.json" ]]; then
  echo "→ Installing Node dependencies in ${WT_DIR}"
  if [[ -f "$WT_DIR/pnpm-lock.yaml" ]] && command -v pnpm >/dev/null 2>&1; then
    (cd "$WT_DIR" && pnpm install)
  elif [[ -f "$WT_DIR/yarn.lock" ]] && command -v yarn >/dev/null 2>&1; then
    (cd "$WT_DIR" && yarn install)
  else
    (cd "$WT_DIR" && npm install)
  fi
else
  echo "ℹ️  No package.json in ${WT_DIR}; skipping Node install."
fi

echo "✅ Worktree ready: ${WT_DIR}"
