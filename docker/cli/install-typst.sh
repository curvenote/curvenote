#!/usr/bin/env bash
set -euo pipefail

# Mirrors typst-community/setup-typst asset selection for linux/x64.
TYPST_VERSION="${TYPST_VERSION:-latest}"
TARGET="x86_64-unknown-linux-musl"
ARCHIVE="typst-${TARGET}.tar.xz"
FOLDER="typst-${TARGET}"

if [ "${TYPST_VERSION}" = "latest" ]; then
  TYPST_VERSION="$(
    curl -fsSL https://api.github.com/repos/typst/typst/releases/latest \
      | sed -n 's/.*"tag_name": "v\([^"]*\)".*/\1/p' \
      | head -n 1
  )"
fi

if [ -z "${TYPST_VERSION}" ]; then
  echo "Failed to resolve Typst version" >&2
  exit 1
fi

URL="https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/${ARCHIVE}"
echo "Installing Typst v${TYPST_VERSION} from ${URL}"

curl -fsSL "${URL}" -o "/tmp/${ARCHIVE}"
tar -xJf "/tmp/${ARCHIVE}" -C /usr/local/bin --strip-components=1 "${FOLDER}/typst"
rm "/tmp/${ARCHIVE}"

typst --version
