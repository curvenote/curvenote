#!/bin/sh
# Create SCMS logical buckets in MinIO and apply public-read + CORS for CDN-facing ones.
set -eu

mc alias set local http://minio:9000 curvenote curvenote

# Keep URI names aligned with historical GCS bucket names so keys/mirrors stay portable.
BUCKETS='cdn-curvenote-dev-1 cdn-pub-curvenote-dev-1 cdn-private-curvenote-dev-1 cdn-tmp-curvenote-dev-1 hashstore-curvenote-dev-1 staging-curvenote-dev-1'
CDN_BUCKETS='cdn-curvenote-dev-1 cdn-pub-curvenote-dev-1 cdn-private-curvenote-dev-1 cdn-tmp-curvenote-dev-1'

for b in $BUCKETS; do
  mc mb -p "local/$b" || true
done

for b in $CDN_BUCKETS; do
  mc anonymous set download "local/$b" || true
done

# CORS for browser PUTs is set globally via MINIO_API_CORS_ALLOW_ORIGIN on the minio service.

echo 'MinIO buckets ready.'
