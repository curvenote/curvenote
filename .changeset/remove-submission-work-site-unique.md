---
'@curvenote/scms-db': patch
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Remove the `(work_id, site_id)` unique constraint migration and Prisma `@@unique`. Submit-to-site now serializes concurrent first-time submits with a PostgreSQL advisory transaction lock instead of relying on a database unique index.
