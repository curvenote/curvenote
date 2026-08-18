#!/usr/bin/env bash
# Ensure the local task-converter Docker image exists.
# Builds via services/task-converter `build:local` only when missing.
set -euo pipefail

IMAGE="${TASK_CONVERTER_IMAGE:-task-converter-local}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "✓ Docker image ${IMAGE} already present"
  exit 0
fi

echo "⚙️  Docker image ${IMAGE} not found — building (first time, ~2GB; may take several minutes)…"
cd "$REPO_ROOT/services/task-converter"
bun run build:local
echo "✓ Built ${IMAGE}"
