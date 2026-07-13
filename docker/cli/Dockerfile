FROM node:24-bookworm-slim AS base

ARG CURVENOTE_VERSION
RUN test -n "$CURVENOTE_VERSION"

LABEL org.opencontainers.image.source="https://github.com/curvenote/curvenote"
LABEL org.opencontainers.image.description="Curvenote CLI"
LABEL org.opencontainers.image.version="${CURVENOTE_VERSION}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g "curvenote@${CURVENOTE_VERSION}"

WORKDIR /work
ENTRYPOINT ["curvenote"]
CMD ["--help"]

# CLI only.
FROM base AS slim

# Full toolchain — Typst, fonts, and image conversion tools.
FROM base AS full

ARG TYPST_VERSION=latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto \
    ghostscript \
    imagemagick \
    inkscape \
    webp \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Allow PDF -> PNG conversions via ImageMagick.
RUN sed -i '/domain="coder" rights="none"/d' /etc/ImageMagick-6/policy.xml

COPY install-typst.sh /tmp/install-typst.sh
RUN chmod +x /tmp/install-typst.sh \
    && TYPST_VERSION="${TYPST_VERSION}" /tmp/install-typst.sh \
    && rm /tmp/install-typst.sh
