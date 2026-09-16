#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USAGE="Usage: bun run agents:setup claude"

usage_exit() {
  echo "$USAGE" >&2
  exit 1
}

if [[ "$#" -ne 1 ]]; then
  usage_exit
fi

AGENT="$1"

case "$AGENT" in
  claude) ;;
  *) usage_exit ;;
esac

if [[ ! -f "$ROOT/AGENTS.md" ]]; then
  echo "error: AGENTS.md not found at $ROOT/AGENTS.md" >&2
  exit 1
fi

if [[ ! -d "$ROOT/.agents/skills" ]]; then
  echo "error: .agents/skills/ not found at $ROOT/.agents/skills" >&2
  exit 1
fi

canonical_dir() {
  (cd "$1" && pwd -P)
}

# dest_path relative_from_parent parent_dir
# Example: ensure_dir_symlink "$ROOT/.claude/skills" "../.agents/skills" "$ROOT/.claude"
ensure_dir_symlink() {
  local dest="$1"
  local rel="$2"
  local parent="$3"
  local canonical
  canonical="$(canonical_dir "$ROOT/.agents/skills")"

  mkdir -p "$parent"

  if [[ -L "$dest" ]]; then
    local resolved=""
    if resolved="$(canonical_dir "$dest" 2>/dev/null)"; then
      if [[ "$resolved" == "$canonical" ]]; then
        return 0
      fi
    fi
    echo "error: $dest exists as a symlink to $(readlink "$dest"), not .agents/skills" >&2
    echo "Remove or rename it, then re-run: bun run agents:setup $AGENT" >&2
    exit 1
  fi

  if [[ -e "$dest" ]]; then
    echo "error: $dest exists and is not a symlink to .agents/skills" >&2
    echo "Remove or rename it, then re-run: bun run agents:setup $AGENT" >&2
    exit 1
  fi

  ln -s "$rel" "$dest"
}

ensure_file_symlink() {
  local dest="$1"
  local rel="$2"
  local canonical
  canonical="$(canonical_dir "$(dirname "$ROOT/AGENTS.md")")/AGENTS.md"

  if [[ -L "$dest" ]]; then
    local resolved=""
    if resolved="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$dest" 2>/dev/null)"; then
      if [[ "$resolved" == "$canonical" ]]; then
        return 0
      fi
    fi
    echo "error: $dest exists as a symlink to $(readlink "$dest"), not AGENTS.md" >&2
    echo "Remove or rename it, then re-run: bun run agents:setup $AGENT" >&2
    exit 1
  fi

  if [[ -e "$dest" ]]; then
    echo "error: $dest exists and is not a symlink to AGENTS.md" >&2
    echo "Remove or rename it, then re-run: bun run agents:setup $AGENT" >&2
    exit 1
  fi

  ln -s "$rel" "$dest"
}

remove_legacy_root_claude_md() {
  local dest="$ROOT/CLAUDE.md"
  if [[ ! -L "$dest" ]]; then
    return 0
  fi
  local canonical
  canonical="$(canonical_dir "$(dirname "$ROOT/AGENTS.md")")/AGENTS.md"
  local resolved=""
  if resolved="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$dest" 2>/dev/null)"; then
    if [[ "$resolved" == "$canonical" ]]; then
      rm "$dest"
    fi
  fi
}

setup_claude() {
  ensure_dir_symlink "$ROOT/.claude/skills" "../.agents/skills" "$ROOT/.claude"
  ensure_file_symlink "$ROOT/.claude/CLAUDE.md" "../AGENTS.md"
  remove_legacy_root_claude_md
}

setup_claude
