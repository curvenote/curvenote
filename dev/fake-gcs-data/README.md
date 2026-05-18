# fake-gcs-server preload buckets

Each directory here becomes a GCS bucket in [fake-gcs-server](https://github.com/fsouza/fake-gcs-server) when `./docker-compose.gcs.yml` mounts this folder to `/data`.

Names must match `api.knownBucketInfoMap.*.uri` in your `.app-config.development.yml`.

Add object files under a bucket folder to preload objects, or leave directories empty and let uploads create content.
