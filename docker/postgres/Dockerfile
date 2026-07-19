# Local SCMS Postgres with the same async-job extensions as Supabase:
#   - pgmq   (job queue)            built from tembo-io/pgmq
#   - pg_net (async http for wakes) built from supabase/pg_net
#   - pg_cron (backup wake cron)    from the PGDG apt package
#
# This mirrors the supabase provider locally so `npm run dev` exercises the real
# pgmq + pg_net enqueue-wake path instead of the in-memory mock queue.
FROM postgres:16-bookworm

ARG PGMQ_VERSION=v1.4.4
ARG PG_NET_VERSION=v0.14.0

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        git \
        libcurl4-openssl-dev \
        postgresql-server-dev-16 \
        postgresql-16-cron; \
    # pgmq (SQL/C extension — no pgrx/Rust needed for the core extension) \
    git clone --depth 1 --branch "${PGMQ_VERSION}" https://github.com/tembo-io/pgmq.git /tmp/pgmq; \
    make -C /tmp/pgmq/pgmq-extension; \
    make -C /tmp/pgmq/pgmq-extension install; \
    # pg_net (C extension, links libcurl) \
    git clone --depth 1 --branch "${PG_NET_VERSION}" https://github.com/supabase/pg_net.git /tmp/pg_net; \
    make -C /tmp/pg_net; \
    make -C /tmp/pg_net install; \
    # Trim build deps to keep the image lean \
    apt-get purge -y --auto-remove build-essential git postgresql-server-dev-16; \
    rm -rf /tmp/pgmq /tmp/pg_net /var/lib/apt/lists/*

# pg_cron and pg_net each run a single background worker bound to ONE database
# (cron.database_name / pg_net.database_name, both default 'postgres'). Our app
# uses the `journals` db, so point both workers there — otherwise the workers
# attach to `postgres` and never see the queue/cron jobs created in `journals`.
RUN set -eux; \
    echo "shared_preload_libraries = 'pg_cron,pg_net'" >> /usr/share/postgresql/postgresql.conf.sample; \
    echo "cron.database_name = 'journals'" >> /usr/share/postgresql/postgresql.conf.sample; \
    echo "pg_net.database_name = 'journals'" >> /usr/share/postgresql/postgresql.conf.sample
