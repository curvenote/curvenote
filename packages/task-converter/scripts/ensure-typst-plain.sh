#!/usr/bin/env bash
#
# Clone curvenote-themes/typst-plain into packages/task-converter/typst-plain
# if that folder does not already exist.
#
set -euo pipefail

REPO_URL="https://github.com/curvenote-themes/typst-plain"
TARGET_DIR="typst-plain"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ -d "$TARGET_DIR" ]; then
  echo "typst-plain already present, skipping clone."
  exit 0
fi

echo "Cloning typst-plain from $REPO_URL ..."
git clone "$REPO_URL" "$TARGET_DIR"
echo "typst-plain ready."
