#!/bin/bash

# local.sh - Build task-converter package, copy assets into this folder, build Docker image, then run locally.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# services/task-converter is under repo root; package is at repo/packages/task-converter
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PACKAGE_DIR="$REPO_ROOT/packages/task-converter"
cd "$SCRIPT_DIR"

echo "Building task-converter package..."
cd "$PACKAGE_DIR"
npm install
npm run build

echo "Copying dist and typst-plain into services/task-converter (keeping local package.json and package-lock.json)..."
rm -rf "$SCRIPT_DIR/dist"
cp -r dist "$SCRIPT_DIR/"
rm -rf "$SCRIPT_DIR/typst-plain"
cp -r typst-plain "$SCRIPT_DIR/"

cd "$SCRIPT_DIR"

echo "Building local Docker image..."
docker build --tag task-converter-local .

echo "Local build complete!"

if [ -f ".env" ]; then
    source .env
    echo "Starting container with .env..."
    docker run -p "${PORT:-8080}:8080" \
      --name task-converter-local \
      --rm \
      task-converter-local
else
    echo "No .env found. To run: docker run -p 8080:8080 --rm task-converter-local"
    echo "Or copy .env.sample to .env and run ./local.sh again."
fi
