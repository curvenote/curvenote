#!/usr/bin/env bash

# Load KEY=VALUE pairs from a dotenv file into the environment.
# - Skips blank lines and full-line comments
# - Strips inline comments: FOO=bar # comment
# - Does not override variables already set in the environment

load_env_file() {
  local file="$1"
  [[ -f "${file}" ]] || return 0

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "${line}" || "${line}" =~ ^# ]] && continue

    if [[ "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"
      value="${value%%#*}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"

      if [[ -z "${!key:-}" ]]; then
        export "${key}=${value}"
      fi
    fi
  done < "${file}"
}
