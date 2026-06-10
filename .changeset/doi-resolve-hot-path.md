---
'@curvenote/scms-server': patch
'@curvenote/scms-db': patch
'@curvenote/scms': patch
---

Speed up site DOI resolution under load (`GET /v1/sites/:siteName/doi/:first/:second`).

- **Query:** start from btree-backed `WorkVersion.doi` / `Work.doi` equality, join to published `SubmissionVersion` rows scoped by `site_id`, then hydrate the DTO by primary key — avoids Prisma `OR` duplicating `WorkVersion` joins and rooting the plan at `SubmissionVersion`.
- **Index:** partial `(work_version_id, date_created DESC) WHERE status = 'PUBLISHED'` via `CREATE INDEX CONCURRENTLY` for the latest-published probe after DOI lookup.
