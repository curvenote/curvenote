# Node.js 22.x (bookworm — bullseye security packages 404 on current Debian mirrors)
FROM node:22-bookworm-slim

# System deps: pandoc, unoconv, LibreOffice (writer) for unoconv, typst
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    pandoc \
    unoconv \
    libreoffice-writer \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install typst from GitHub release (match image arch)
ARG TARGETARCH
ARG TYPST_VERSION=0.14.2
RUN ARCH="$(case "${TARGETARCH}" in amd64) echo x86_64;; arm64) echo aarch64;; *) echo x86_64;; esac)" \
    && curl -sSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${ARCH}-unknown-linux-musl.tar.xz" \
    | tar -xJ -C /tmp \
    && mv "/tmp/typst-${ARCH}-unknown-linux-musl/typst" /usr/local/bin/ \
    && rm -rf /tmp/typst-*

# Curvenote CLI (latest)
RUN npm update -g npm \
    && npm i -g curvenote@latest

WORKDIR /usr/app

# Pre-built assets (copied into this folder by build:service or local.sh before docker build)
COPY dist/ ./dist/
COPY package.json package-lock.json ./
COPY typst-plain/ ./typst-plain/
COPY NOTICE ./NOTICE

RUN npm ci

CMD ["npm", "run", "start"]
