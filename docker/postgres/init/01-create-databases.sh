#!/bin/sh
# Runs once on first container start. Creates SCMS dev + test databases.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
	-- SUPERUSER (local dev only) so Prisma migrations can run CREATE EXTENSION
	-- pgmq / pg_net / pg_cron without a separate privileged bootstrap step.
	CREATE USER journals WITH ENCRYPTED PASSWORD 'curvenote' CREATEDB SUPERUSER;
	CREATE DATABASE journals OWNER journals;
	CREATE DATABASE journals_test OWNER journals;
EOSQL

for db in journals journals_test; do
	psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
		GRANT ALL ON SCHEMA public TO journals;
		ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO journals;
		ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO journals;
	EOSQL
done
