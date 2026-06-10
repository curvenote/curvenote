---
'@curvenote/scms-db': patch
---

Add btree index on `WorkVersion.work_id` (migration `20260610160000_add_work_version_work_id_index`, `CREATE INDEX CONCURRENTLY`) for work-scoped version lookups and Work → versions joins on the large `WorkVersion` table.
