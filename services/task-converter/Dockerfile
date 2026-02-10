FROM node:22-bullseye-slim

# System deps: pandoc, unoconv, minimal LibreOffice (writer) for unoconv, typst
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    pandoc \
    unoconv \
    libreoffice-writer \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install typst from GitHub release (x86_64 Linux musl)
ARG TYPST_VERSION=0.11.0
RUN curl -sSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
    | tar -xJ -C /tmp \
    && mv /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/ \
    && rm -rf /tmp/typst-*

# Curvenote CLI (latest)
RUN npm update -g npm \
    && npm install -g @curvenote/cli@latest

WORKDIR /usr/app

# Pre-built assets (copied into this folder by build:service or local.sh before docker build)
COPY dist/ ./dist/
COPY package.json ./
COPY typst-plain/ ./typst-plain/

RUN npm install

CMD ["npm", "run", "start"]
