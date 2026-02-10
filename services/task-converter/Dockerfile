# Node.js 22.x
FROM node:22-bullseye-slim

# System deps: pandoc, unoconv, minimal LibreOffice (writer) for unoconv, typst
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    pandoc \
    unoconv \
    libreoffice \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install typst from GitHub release (x86_64 Linux musl)
ARG TYPST_VERSION=0.14.2
RUN curl -sSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
    | tar -xJ -C /tmp \
    && mv /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/ \
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
